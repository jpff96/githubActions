import { format, utcToZonedTime } from 'date-fns-tz';
import { TimeZoneType } from '../../../../libs/enumLib';

/**
 * Creates a batch number based on a date
 * @param date Date to be used to create the batch number
 */
export const createBatchNumber = (date: Date): string => {
  const timeZone = TimeZoneType.AmericaChicago;
  const formatOptions = { timeZone };
  const dateTz = utcToZonedTime(date, timeZone);
  const dayPeriod = format(dateTz, 'aa', formatOptions);
  const formattedDate = format(dateTz, 'yyyyMMdd', formatOptions) + dayPeriod;

  return formattedDate;
};
