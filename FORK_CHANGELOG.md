# Change Log of this fork
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.8.0] - 2020-06-29
### Added
- `DEFAULT_FORMAT` option to always convert an image to a given format when AutoWebP is not used and no other outputFormat is defined via sharp edits

## [1.7.1] - 2020-05-11
### Fixed
- regex in `overlayWithGradient` for `top`, `left` and `radius` to accept float values

## [1.7.0] - 2020-02-24
### Added
- `edits.overlayWithGradient` handling to create a buffer of an SVG gradient and composite the result over the
  processed image
- `Dockerfile`

## [1.6.0] - 2021-02-19
### Changed
- `toFormat` to `outputFormat` parameter to be consistent with sharp API. `toFormat` will still be supported until 2.0.

### Added
- when using the default request scheme (base64), outputOptions can now be passed to sharp.
  Example unencoded:
  ```json
    {
    "bucket": "my-bucket",
    "key": "my-image.jpg",
    "edits": {
      "resize": {
        "width": 300,
        "height": 300,
        "fit": "inside"
      }
    },
    "outputFormat": "webp",
    "outputOptions": {
      "nearLossless": true,
      "quality": 90
    }
  }
  ```

## [1.5.1] - 2020-11-13
### Fixed
- AUTO_WEBP toggle

## [1.5.0] - 2020-11-12
### Removed
- Definition of a regex to match user agents against as it's _very_ slow and needs
  user-agent as cache keys

## [1.5.0-alpha1] - 2020-11-06
### Added
- Allow definition of a regex to match user agents against. This can be used to enable/disable webp selectively

## [1.4.1] - 2020-05-26
### Updated
- shorten IAM role names to allow for longer stack names (max size is 64 chars)

## [1.4.0] - 2020-05-26
### Added
- Allow specification of maximum image size; will return a HTTP 400 when exceeded
- Allow whitelisting of target dimensions; will return HTTP 400 when other sizes are requested

### Updated
- sharp to 0.25.3 (from 0.23.4)

### Fixed
- Error in explicit size parsing for sizes < 100px

## [1.3.0] - 2020-03-30
### Added
- Allow explicit sizes in urls (take precedence over encoded ones)

## [1.2.0] - 2020-03-27
### Added
- Changes from upstream version 4.2
- Logger and log controls in cloud formation interface
- CHANGELOG file

## [1.1.0] - 2019-12-16
### Added
- Changes from upstream version 4.1
