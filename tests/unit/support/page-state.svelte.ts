/** Reactive stand-in for `$app/state`'s `page`, so Back-pop effects can be driven in unit tests. */
let value = $state<{ instrumentPanel?: boolean }>({});

export const pageState = {
  get value() {
    return value;
  },
  set value(next: { instrumentPanel?: boolean }) {
    value = next;
  }
};

export const mock = {
  page: {
    get state() {
      return value;
    },
    url: { pathname: '/' }
  }
};
