import { addDays, formatISO } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { TimeZoneType } from '../../../../libs/enumLib';

/**
 * Creates a batch date
 * @param date Date to create the batch date
 */
export const createBatchDate = (date: Date): Date => {
  // TODO: This must came from configuration (different products can have different rules)
  let nextDate = date;
  let stringHours: string;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  if (hours < 15 || (hours === 15 && minutes === 0)) { // 10 AM CT; AM batch
    stringHours = '10:00:00';
  } else if (hours < 22 || (hours === 22 && minutes === 0)) { // 5 PM CT; PM batch
    stringHours = '17:00:00';
  } else { // Next AM batch
    stringHours = '10:00:00';
    nextDate = addDays(date, 1);
  }

  const day = formatISO(nextDate, { representation: 'date' });
  const batchDate = zonedTimeToUtc(`${day} ${stringHours}`, TimeZoneType.AmericaChicago);

  return batchDate;
};
