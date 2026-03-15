const { logger, setLogLevel } = require('./lib/utils/logger');

logger.info("Test info message");
setLogLevel('warn');
logger.info("This should not be logged to console if log level is warn");
logger.warn("This should be logged to console");
