import * as chai from 'chai';
import { createBatchDate } from '../helpers/createBatchDate';
import { createBatchNumber } from '../helpers/createBatchNumber';

const { expect } = chai;

describe('Disbursement helpers tests', () => {
  context('createBatchDate', () => {
    it('Should create a batch date (AM)', () => {
      const todayAmBatch = new Date('2021-09-01T15:00:00.000Z');
      const resultTodayAmBatch = createBatchDate(todayAmBatch);

      expect(resultTodayAmBatch.toISOString(), 'resultTodayAmBatch').to.eq('2021-09-01T15:00:00.000Z');
    });

    it('Should create a batch date (PM)', () => {
      const todayPmBatch = new Date('2021-09-01T15:01:00.000Z');
      const resultTodayPmBatch = createBatchDate(todayPmBatch);

      expect(resultTodayPmBatch.toISOString(), 'resultTodayPmBatch').to.eq('2021-09-01T22:00:00.000Z');
    });

    it('Should create a batch date (next day AM)', () => {
      const nextAmBatch = new Date('2021-09-01T22:01:00.000Z');
      const resultNextAmBatch = createBatchDate(nextAmBatch);

      expect(resultNextAmBatch.toISOString(), 'resultNextAmBatch').to.eq('2021-09-02T15:00:00.000Z');
    });
  });

  context('createBatchNumber', () => {
    it('Should create a batch number (AM)', () => {
      const todayAmBatch = new Date('2021-09-01T15:00:00.000Z');
      const resultTodayAmBatch = createBatchNumber(todayAmBatch);

      expect(resultTodayAmBatch, 'resultTodayAmBatch').to.eq('20210901AM');
    });

    it('Should create a batch number (PM)', () => {
      const todayPmBatch = new Date('2021-09-01T22:00:00.000Z');
      const resultTodayPmBatch = createBatchNumber(todayPmBatch);

      expect(resultTodayPmBatch, 'resultTodayPmBatch').to.eq('20210901PM');
    });

    it('Should create a batch number (next day AM)', () => {
      const nextAmBatch = new Date('2021-09-02T15:00:00.000Z');
      const resultNextAmBatch = createBatchNumber(nextAmBatch);

      expect(resultNextAmBatch, 'resultNextAmBatch').to.eq('20210902AM');
    });
  });
});
