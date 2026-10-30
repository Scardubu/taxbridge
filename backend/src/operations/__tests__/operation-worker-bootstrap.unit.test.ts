const mockWorkerOn = jest.fn();
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: mockWorkerOn })),
}));
jest.mock('../../lib/redis', () => ({ redis: {} }));

describe('operation worker bootstrap', () => {
  it('registers built-in handlers before creating the worker', () => {
    jest.resetModules();
    const { getOperationHandler } = require('../registry');
    const { startOperationWorker } = require('../operation-worker');

    expect(getOperationHandler('crud')).toBeUndefined();
    startOperationWorker();
    expect(getOperationHandler('crud')).toEqual(expect.any(Function));
  });
});
