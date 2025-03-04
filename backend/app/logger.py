import logging
import sys

from pythonjsonlogger import jsonlogger


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Prevent duplicate logs
    if logger.handlers:
        return logger

    # JSON formatter for structured logging
    class CustomJsonFormatter(jsonlogger.JsonFormatter):
        def add_fields(
            self, log_record: dict, record: logging.LogRecord, message_dict: dict
        ) -> None:
            super(CustomJsonFormatter, self).add_fields(
                log_record, record, message_dict
            )
            log_record["logger"] = record.name
            log_record["level"] = record.levelname
            log_record["timestamp"] = self.formatTime(record)
            if "exc_info" in log_record:
                log_record["exception"] = log_record["exc_info"]
                del log_record["exc_info"]

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = CustomJsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(message)s"
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger


# Create main application logger
logger = setup_logger("wealth_manager")


def get_logger(name: str) -> logging.Logger:
    return setup_logger(name)
