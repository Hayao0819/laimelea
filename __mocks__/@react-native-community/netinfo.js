const listeners = new Set();

const NetInfo = {
  addEventListener: jest.fn((callback) => {
    listeners.add(callback);
    callback({ isConnected: true, isInternetReachable: true });
    return () => listeners.delete(callback);
  }),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
  __listeners: listeners,
};

export default NetInfo;
