# Unit / Component Testing Guide

React 19 + @testing-library/react-native (RNTL) v13 + Jotai v2 atomWithStorage の組み合わせで発生する strict act() check 問題とその対処パターン。

## RNTL v13 の async API

v13 で `render()`, `fireEvent.*()`, `act()` はすべて **async** になった。`render()` は Promise を返すため、必ず `await` すること。

```tsx
// BAD — render() の Promise が await されず act() 警告が出る
const utils = render(<MyComponent />);

// GOOD
const utils = await render(<MyComponent />);
```

## テスト renderHelper の標準パターン

Jotai `atomWithStorage` + `{ getOnInit: true }` は AsyncStorage から非同期読み込みを行い、解決前は Suspense 状態になる。`await render()` 後に `await act(async () => {})` を入れて非同期解決をフラッシュする。

```tsx
async function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <MyScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  // atomWithStorage の非同期読み込み完了を待つ
  await act(async () => {});
  return { ...utils, store };
}
```

## act() フラッシュの落とし穴

### store.set() した値が act() で上書きされる

`atomWithStorage` + `getOnInit: true` は、Jotai ストアの購読開始時にも AsyncStorage から読み込む。テストのモック AsyncStorage は通常空なので `null` → デフォルト値が返り、`store.set()` で設定した値が上書きされる。

```tsx
// BAD — act() が stopwatchStorageAtom の非同期読み込みをフラッシュし、
// store.set() で設定した値がデフォルト値に上書きされる
store.set(stopwatchAtom, { elapsedMs: 3000, isRunning: false, ... });
const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
await act(async () => {});
expect(result.current.elapsedMs).toBe(3000); // FAIL: 0 になる

// GOOD — atom の初期値を restore テストで使う場合は act() を省略
store.set(stopwatchAtom, { elapsedMs: 3000, isRunning: false, ... });
const { result } = renderHook(() => useStopwatch(), { wrapper: Wrapper });
expect(result.current.elapsedMs).toBe(3000); // PASS
```

**判断基準**: `store.set()` でテスト固有の値を注入し、その値を即座にアサーションする場合は `act()` フラッシュを省略する。コンポーネントの render 後にインタラクション（fireEvent）を行うテストでは `act()` フラッシュが必要。

### react-native-paper Portal との非互換

`act()` フラッシュが atomWithStorage の非同期解決をトリガーすると、コンポーネントが再レンダーされる。この再レンダーが react-native-paper の `Portal` / `PortalManager` の状態をリセットし、`<Dialog>` が表示されなくなる。

```tsx
// BAD — act() フラッシュ後に Dialog の Portal が壊れる
await renderWithProviders(); // 内部で await act(async () => {})
await fireEvent.press(getByTestId("open-dialog-button"));
expect(getByTestId("my-dialog")).toBeTruthy(); // FAIL: Dialog が見つからない
```

**対処法**: Portal を使うコンポーネント（Dialog, Menu, Modal 等）のテストファイルでは、`act()` フラッシュを省略し、代わりに console.error を抑制する。

```tsx
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("not wrapped in act(")) return;
    if (msg.includes("suspended inside an `act` scope")) return;
    if (msg.includes("suspended resource finished loading")) return;
    originalConsoleError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});
```

### render() を act() 内で呼ばない

RNTL v13 の `render()` は内部で `act()` を呼ぶ。外側からさらに `act()` で囲むと React 19 で `Can't access .root on unmounted test renderer` エラーが発生する。

```tsx
// BAD — 二重 act() で unmounted エラー
await act(async () => {
  utils = await render(<MyComponent />);
});

// GOOD — render() 単独で await
const utils = await render(<MyComponent />);
await act(async () => {}); // 後続フラッシュは別の act() で
```

## AsyncStorage モックの標準形

```tsx
jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});
```

## atomWithStorage をテストで同期的にする

useEffect 内の async 状態更新が act() の外で実行される問題を根本的に解決するには、`atomWithStorage` を同期アトムに置き換える。

```tsx
// settingsAtom (atomWithStorage) を同期 atom にモック
jest.mock("../../src/atoms/settingsAtoms", () => {
  const { atom } = require("jotai");
  const { DEFAULT_SETTINGS } = require("../../src/models/Settings");
  const settingsAtom = atom(DEFAULT_SETTINGS);
  return {
    settingsAtom,
    resolvedSettingsAtom: atom((get: (a: unknown) => unknown) => ({
      ...DEFAULT_SETTINGS,
      ...get(settingsAtom),
    })),
    cycleConfigAtom: atom(
      (get: (a: unknown) => unknown) =>
        (get(settingsAtom) as typeof DEFAULT_SETTINGS).cycleConfig,
    ),
  };
});
```

**注意**: `createAsyncStorage` を同期ストレージにモックする方法もあるが、Jotai の `atomWithStorage` + `getOnInit: true` は購読開始時にストレージから再読み込みし、`store.set()` した値を上書きするため非推奨。

## まとめ: パターン選択フローチャート

1. **コンポーネントが atomWithStorage を使用?**
   - No → `await render()` だけで OK
   - Yes → 2 へ

2. **テストで Portal (Dialog/Menu/Modal) をテスト?**
   - Yes → `act()` フラッシュ省略 + console.error 抑制
   - No → 3 へ

3. **テストで `store.set()` した値を即座にアサーション?**
   - Yes → `act()` フラッシュ省略（値が上書きされるため）
   - No → `await render()` + `await act(async () => {})` を使用
