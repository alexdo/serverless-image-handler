/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const AWS = require('aws-sdk');
const sharp = require('sharp');
const logger = require('./logger');

class ImageHandler {

    /**
     * Main method for processing image requests and outputting modified images.
     * @param {ImageRequest} request - An ImageRequest object.
     */
    async process(request) {
        const { originalImage, edits } = request;
        let { outputFormat, outputOptions } = request;
        if (edits !== undefined) {
            if (edits.quality) {
                outputOptions.quality = edits.quality;
                delete edits.quality;

                if (outputFormat === undefined) {
                    const metadata = await originalImage.metadata();
                    outputFormat = metadata.format;
                }
            }

            const modifiedImage = await this.applyEdits(originalImage, edits);

            if (outputFormat !== undefined) {
                logger.log('format :' + outputFormat);
                logger.log('output options', outputOptions);
                modifiedImage.toFormat(outputFormat, outputOptions);
            }

            const bufferImage = await modifiedImage.toBuffer();
            return bufferImage.toString('base64');
        } else {
            return originalImage.toString('base64');
        }
    }

    /**
     * Applies image modifications to the original image based on edits
     * specified in the ImageRequest.
     * @param {Buffer} originalImage - The original image.
     * @param {Object} edits - The edits to be made to the original image.
     */
    async applyEdits(originalImage, edits) {
        if (edits.resize === undefined) {
            edits.resize = {};
            edits.resize.fit = 'inside';
        }

        const image = sharp(originalImage, { failOnError: false });
        const metadata = await image.metadata();
        const keys = Object.keys(edits);
        const values = Object.values(edits);

        // Apply the image edits
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = values[i];
            if (key === 'overlayWith') {
                let imageMetadata = metadata;
                if (edits.resize) {
                    let imageBuffer = await image.toBuffer();
                    imageMetadata = await sharp(imageBuffer).resize({ edits: { resize: edits.resize }}).metadata();
                }

                const { bucket, key, wRatio, hRatio, alpha } = value;
                const overlay = await this.getOverlayImage(bucket, key, wRatio, hRatio, alpha, imageMetadata);
                const overlayMetadata = await sharp(overlay).metadata();

                let { options } = value;
                if (options) {
                    if (options.left) {
                        let left = options.left;
                        if (left.endsWith('p')) {
                            left = parseInt(left.replace('p', ''));
                            if (left < 0) {
                                left = imageMetadata.width + (imageMetadata.width * left / 100) - overlayMetadata.width;
                            } else {
                                left = imageMetadata.width * left / 100;
                            }
                        } else {
                            left = parseInt(left);
                            if (left < 0) {
                                left = imageMetadata.width + left - overlayMetadata.width;
                            }
                        }
                        options.left = parseInt(left);
                    }
                    if (options.top) {
                        let top = options.top;
                        if (top.endsWith('p')) {
                            top = parseInt(top.replace('p', ''));
                            if (top < 0) {
                                top = imageMetadata.height + (imageMetadata.height * top / 100) - overlayMetadata.height;
                            } else {
                                top = imageMetadata.height * top / 100;
                            }
                        } else {
                            top = parseInt(top);
                            if (top < 0) {
                                top = imageMetadata.height + top - overlayMetadata.height;
                            }
                        }
                        options.top = parseInt(top);
                    }
                }

                const params = [{ ...options, input: overlay }];
                image.composite(params);
            } else if (key === 'smartCrop') {
                const options = value;
                const imageBuffer = await image.toBuffer();
                const boundingBox = await this.getBoundingBox(imageBuffer, options.faceIndex);
                const cropArea = this.getCropArea(boundingBox, options, metadata);
                try {
                    image.extract(cropArea)
                } catch (err) {
                    throw ({
                        status: 400,
                        code: 'SmartCrop::PaddingOutOfBounds',
                        message: 'The padding value you provided exceeds the boundaries of the original image. Please try choosing a smaller value or applying padding via Sharp for greater specificity.'
                    });
                }
            } else if (key === 'overlayWithGradient') {
                const input = Buffer.from(this.generateGradient(edits, metadata), 'utf8');

                try {
                    image.composite([{ input }]);
                } catch (err) {
                    throw ({
                        status: err.statusCode ? err.statusCode : 500,
                        code: err.code,
                        message: err.message
                    });
                }
            } else {
                image[key](value);
            }
        }

        // Return the modified image
        return image;
    }

    /**
     * Gets an image to be used as an overlay to the primary image from an
     * Amazon S3 bucket.
     * @param {string} bucket - The name of the bucket containing the overlay.
     * @param {string} key - The keyname corresponding to the overlay.
     */
    async getOverlayImage(bucket, key, wRatio, hRatio, alpha, sourceImageMetadata) {
        const s3 = new AWS.S3();
        const params = { Bucket: bucket, Key: key };
        try {
            const { width, height } = sourceImageMetadata;
            const overlayImage = await s3.getObject(params).promise();
            let resize = {
                fit: 'inside'
            }

            // Set width and height of the watermark image based on the ratio
            const zeroToHundred = /^(100|[1-9]?[0-9])$/;
            if (zeroToHundred.test(wRatio)) {
                resize['width'] = parseInt(width * wRatio / 100);
            }
            if (zeroToHundred.test(hRatio)) {
                resize['height'] = parseInt(height * hRatio / 100);
            }

            // If alpha is not within 0-100, the default alpha is 0 (fully opaque).
            if (zeroToHundred.test(alpha)) {
                alpha = parseInt(alpha);
            } else {
                alpha = 0;
            }

            const convertedImage = await sharp(overlayImage.Body)
                .resize(resize)
                .composite([{
                    input: Buffer.from([255, 255, 255, 255 * (1 - alpha / 100)]),
                    raw: {
                        width: 1,
                        height: 1,
                        channels: 4
                    },
                    tile: true,
                    blend: 'dest-in'
                }]).toBuffer();
            return Promise.resolve(convertedImage);
        } catch (err) {
            return Promise.reject({
                status: err.statusCode ? err.statusCode : 500,
                code: err.code,
                message: err.message
            })
        }
    }

    /**
     * Calculates the crop area for a smart-cropped image based on the bounding
     * box data returned by Amazon Rekognition, as well as padding options and
     * the image metadata.
     * @param {Object} boundingBox - The boudning box of the detected face.
     * @param {Object} options - Set of options for smart cropping.
     * @param {Object} metadata - Sharp image metadata.
     */
    getCropArea(boundingBox, options, metadata) {
        const padding = (options.padding !== undefined) ? parseFloat(options.padding) : 0;
        // Calculate the smart crop area
        const cropArea = {
            left : parseInt((boundingBox.Left*metadata.width)-padding),
            top : parseInt((boundingBox.Top*metadata.height)-padding),
            width : parseInt((boundingBox.Width*metadata.width)+(padding*2)),
            height : parseInt((boundingBox.Height*metadata.height)+(padding*2)),
        }
        // Return the crop area
        return cropArea;
    }

    /**
     * Gets the bounding box of the specified face index within an image, if specified.
     * @param {Sharp} imageBuffer - The original image.
     * @param {Integer} faceIndex - The zero-based face index value, moving from 0 and up as
     * confidence decreases for detected faces within the image.
     */
    async getBoundingBox(imageBuffer, faceIndex) {
        const rekognition = new AWS.Rekognition();
        const params = { Image: { Bytes: imageBuffer }};
        const faceIdx = (faceIndex !== undefined) ? faceIndex : 0;
        try {
            const response = await rekognition.detectFaces(params).promise();
            return Promise.resolve(response.FaceDetails[faceIdx].BoundingBox);
        } catch (err) {
            console.log(err);
            if (err.message === "Cannot read property 'BoundingBox' of undefined") {
                return Promise.reject({
                    status: 400,
                    code: 'SmartCrop::FaceIndexOutOfRange',
                    message: 'You have provided a FaceIndex value that exceeds the length of the zero-based detectedFaces array. Please specify a value that is in-range.'
                })
            } else {
                return Promise.reject({
                    status: 500,
                    code: err.code,
                    message: err.message
                })
            }
        }
    }

    /**
     * @param {Object} edits
     * @param {Object} metadata
     *
     * @returns {string}
     */
    generateGradient(edits, metadata) {
        const { extend, overlayWithGradient, resize } = edits;
        let { width, height } = metadata;

        if (resize) {
            width = resize.width || width;
            height = resize.height || height;
        }

        if (extend) {
            if (typeof extend === 'number') {
                width += extend * 2;
                height += extend * 2;
            } else {
                const { top, left, right, bottom } = Object.assign(
                    {},
                    {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    },
                    extend
                );

                width += left + right;
                height += top + bottom;
            }
        }

        const defaults = {
            top: '50%',
            left: '50%',
            radius: width / 2,
            stops: [
                ['0%', { r: 0, g: 0, b: 0, alpha: 0}],
                ['100%', { r: 0, g: 0, b: 0, alpha: 0.05}]
            ],
        };

        const settings = Object.assign({}, defaults, overlayWithGradient);

        Object.entries(settings).forEach(([key, value]) => {
            switch (key) {
                case 'top':
                case 'left':
                case 'radius':
                    if (!/^[0-9]+(\.[0-9]+)?[p%]?$/.test(String(value))) {
                        throw ({
                            status: 400,
                            message: `Invalid argument 'edits.overlayWithGradient.${key}' provided for ImageHandler::generateGradient: ${value}`
                        });
                    }

                    settings[key] = String(value).replace('p', '%');

                    return;

                default:
                    return;
            }
        });

        return '' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
                '<defs>' +
                    '<radialGradient id="rgrad" cx="' + settings.left + '" cy="' + settings.top + '" r="' + settings.radius + '" gradientUnits="userSpaceOnUse">' +
                        this.buildStops(settings.stops) +
                    '</radialGradient>' +
                '</defs>' +
                '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="url(#rgrad)" />' +
            '</svg>';
    }

    /**
     * @param {[string, Object]} stops
     *
     * @returns {string}
     */
    buildStops(stops) {
        if (!Array.isArray(stops) || !stops.length) {
            throw ({
                status: 400,
                message: `Invalid argument 'stops' provided for ImageHandler::buildStops: ${value}`
            });
        }

        return stops.map((stop, index) => {
            if (stop.length !== 2) {
                throw ({
                    status: 400,
                    message: `Not enough arguments provided for 'stops[${index}]' ImageHandler::buildStops`
                });
            }

            if (!/^([1-9][0-9]?|100|0)[p%]$/.test(String(stop[0]))) {
                throw ({
                    status: 400,
                    message: `Invalid argument 'stops[${index}][0]' provided for ImageHandler::buildStops: ${stops[index][0]}`
                });
            }

            const offset = String(stop[0]).replace('p', '%');

            const defaults = {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0,
            };

            const settings = Object.assign({}, defaults, stop[1]);

            Object.entries(settings).forEach(([key, value]) => {
                switch (key) {
                    case 'r':
                    case 'g':
                    case 'b':
                        if (typeof value !== 'number' || value < 0 || value > 255) {
                            throw ({
                                status: 400,
                                message: `Invalid argument 'stops[${index}][1].${key}' provided for ImageHandler::buildStops: ${value}`
                            });
                        }

                        return;

                    case 'alpha':
                        if (typeof value !== 'number' || value < 0 || value > 1) {
                            throw ({
                                status: 400,
                                message: `Invalid argument 'stops[${index}][1].${key}' provided for ImageHandler::buildStops: ${value}`
                            });
                        }

                        return;

                    default:
                        return;
                }
            });

            return `<stop offset="${offset}" style="stop-color:rgb(${settings.r},${settings.g},${settings.b});stop-opacity:${settings.alpha}" />`;
        }).join('');
    }
}

// Exports
module.exports = ImageHandler;

