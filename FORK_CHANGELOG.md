# Change Log of this fork
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2020-11-06
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
