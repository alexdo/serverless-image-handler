#!/bin/bash

set -euxo pipefail

rm -rf ./regional-s3-assets ./regional-s3-assets-dev ./regional-s3-assets-stg ./regional-s3-assets-prod ./global-s3-assets
rm -rf ../source/image-handler/node_modules ../source/custom-resource/node_modules
