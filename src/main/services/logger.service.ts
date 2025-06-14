import log from 'electron-log'

// Configure electron-log
// By default, electron-log writes logs to the following locations:
// on Linux: ~/.config/{app name}/logs/{process type}.log
// on macOS: ~/Library/Logs/{app name}/{process type}.log
// on Windows: %USERPROFILE%\AppData\Roaming\{app name}\logs\{process type}.log

// Configure log file rotation
log.transports.file.getFile().clear() // Clear log file on startup

// Set log level based on environment
log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false

// Create a custom format for console logs
log.transports.console.format = '{h}:{i}:{s}.{ms} {level} {text}'

// Create a custom format for file logs
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

class LoggerService {
  // Log levels: error, warn, info, verbose, debug, silly

  error(message: string | Error, ...args: any[]): void {
    if (message instanceof Error) {
      log.error(message.message, message.stack, ...args)
    } else {
      log.error(message, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    log.warn(message, ...args)
  }

  info(message: string, ...args: any[]): void {
    log.info(message, ...args)
  }

  debug(message: string, ...args: any[]): void {
    log.debug(message, ...args)
  }

  // Get the path to the log file
  getLogFilePath(): string {
    return log.transports.file.getFile().path
  }

  // Get all logs as a string
  getAllLogs(): string {
    try {
      return log.transports.file.readAllLogs().join('\n')
    } catch (error) {
      log.error('Failed to read logs:', error)
      return 'Failed to read logs'
    }
  }
}

export const loggerService = new LoggerService()
