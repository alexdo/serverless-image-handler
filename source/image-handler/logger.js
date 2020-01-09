const LOG_LEVELS = [
    'error',
    'warn',
    'debug',
];

const isActive = () => process.env.LOG_LEVEL && LOG_LEVELS.includes(process.env.LOG_LEVEL);
const shouldLogLevel = (level) => isActive() && LOG_LEVELS.indexOf(level) <= LOG_LEVELS.indexOf(process.env.LOG_LEVEL);

const log = (...args) => {
    if (shouldLogLevel('debug')) {
        console.log(...args);
    }
};

const error = (...args) => {
    if (shouldLogLevel('error')) {
        console.error(...args);
    }
};

const warn = (...args) => {
    if (shouldLogLevel('warn')) {
        console.warn(...args);
    }
};

module.exports = {
    LOG_LEVELS,

    isActive,
    shouldLogLevel,

    log,
    error,
    warn,
};

