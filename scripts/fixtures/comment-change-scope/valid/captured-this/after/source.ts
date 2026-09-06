export const valueReader = {
  value: 1,
  create() {
    const instanceContext1 = this;
    return function readValue() {
      return instanceContext1.value;
    };
  },
};
