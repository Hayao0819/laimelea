import { enqueueAlarmMutation } from "../../../../src/features/alarm/services/alarmMutationQueue";

describe("alarmMutationQueue", () => {
  it("runs operations from independent call sites in FIFO order", async () => {
    const order: string[] = [];
    const first = enqueueAlarmMutation(async () => {
      order.push("first-start");
      await Promise.resolve();
      order.push("first-end");
      return "first";
    });
    const second = enqueueAlarmMutation(async () => {
      order.push("second-start");
      return "second";
    });

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("continues processing subsequent operations after a rejection", async () => {
    const failing = enqueueAlarmMutation(() =>
      Promise.reject(new Error("boom")),
    );
    const succeeding = enqueueAlarmMutation(() => Promise.resolve("ok"));

    await expect(failing).rejects.toThrow("boom");
    await expect(succeeding).resolves.toBe("ok");
  });

  it("propagates each operation's own result and error independently", async () => {
    const results = await Promise.allSettled([
      enqueueAlarmMutation(() => Promise.resolve(1)),
      enqueueAlarmMutation(() => Promise.reject(new Error("nope"))),
      enqueueAlarmMutation(() => Promise.resolve(3)),
    ]);

    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1]).toMatchObject({ status: "rejected" });
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });
});
