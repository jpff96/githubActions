export const logError = (debug, err, prefix) => {
  if (!prefix) {
    prefix = '';
  }

  debug(`${prefix} ERROR`, err?.message || '');
};
