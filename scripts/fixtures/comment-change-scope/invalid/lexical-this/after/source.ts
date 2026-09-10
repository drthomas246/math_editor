export const valueReader = {
  value: 1,
  create() {
    return function readValue(this: { value: number }) {
      return this.value;
    };
  },
};
