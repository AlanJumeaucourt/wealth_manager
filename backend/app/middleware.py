import time
from flask import request, g
from functools import wraps
from flask_jwt_extended import get_jwt_identity
from .logger import logger

def get_user_id():
    """Get user_id from JWT token if available"""
    try:
        return get_jwt_identity()
    except:
        return None

def log_request():
    """Log incoming request details"""
    g.start_time = time.time()
    user_id = get_user_id()

    log_data = {
        'method': request.method,
        'path': request.path,
        'remote_addr': request.remote_addr,
        'user_agent': request.user_agent.string,
    }

    if user_id:
        log_data['user_id'] = user_id

    logger.info('Request started', extra=log_data)

def log_response(response):
    """Log response details"""
    if not hasattr(g, 'start_time'):
        return response

    duration = time.time() - g.start_time
    status_code = response.status_code
    user_id = get_user_id()

    log_data = {
        'method': request.method,
        'path': request.path,
        'status': status_code,
        'duration': f"{duration:.3f}s",
    }

    if user_id:
        log_data['user_id'] = user_id

    logger.info('Request finished', extra=log_data)
    return response

def error_logging_decorator(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            user_id = get_user_id()
            log_data = {
                'method': request.method,
                'path': request.path,
                'error': str(e),
                'error_type': type(e).__name__
            }

            if user_id:
                log_data['user_id'] = user_id

            logger.error('Exception occurred', extra=log_data, exc_info=True)
            raise
    return decorated_function
