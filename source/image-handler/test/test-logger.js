const logger = require('../logger');
let assert = require('assert');

const stdout = require("test-console").stdout;
const stderr = require("test-console").stderr;

// ----------------------------------------------------------------------------
// process()
// ----------------------------------------------------------------------------
describe('process()', function() {
    describe('001/logger', function() {
        it(`does nothing when unconfigured`, function() {
            process.env = {
            };

            const logSomeMessages = () => {
                logger.log("foo");
                logger.warn("bar");
                logger.error("baz");
            };

            const output = stdout.inspectSync(logSomeMessages);
            const errorOutput = stderr.inspectSync(logSomeMessages);



            assert.deepEqual(output, []);
            assert.deepEqual(errorOutput, []);
        });

        it(`logs everything nothing on level debug`, function() {
            process.env = {
                LOG_LEVEL: 'debug',
            };

            const logSomeMessages = () => {
                logger.log("foo");
                logger.warn("bar");
                logger.error("baz");
            };

            const output = stdout.inspectSync(logSomeMessages);
            const errorOutput = stderr.inspectSync(logSomeMessages);



            assert.deepEqual(output, ["foo\n"]);
            assert.deepEqual(errorOutput, ["bar\n", "baz\n"]);
        });
    });
});
