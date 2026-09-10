export const valueReader = {
  value: 1,
  create() {
    return () => this.value;
  },
};
