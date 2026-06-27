export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: any;
}

export class Logger {
  private logLevel: LogLevel;
  private context: string;

  constructor(context = "CIC", logLevel = LogLevel.INFO) {
    this.context = context;
    this.logLevel = logLevel;
  }

  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log("DEBUG", message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log("INFO", message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log("WARN", message, data);
    }
  }

  error(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log("ERROR", message, data);
    }
  }

  private log(level: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
    };

    const output = JSON.stringify(entry);

    if (level === "ERROR") {
      console.error(output);
    } else if (level === "WARN") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.logLevel);
  }
}

export const defaultLogger = new Logger("CIC", LogLevel.INFO);
