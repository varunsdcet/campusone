import { describe, expect, it } from "vitest";
import { STUDENT_MONEY_LOCK_SQL, withStudentMoneyLock } from "./studentLock.js";

const institutionId = "00000000-0000-4000-8000-000000000004";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("withStudentMoneyLock", () => {
  it("uses integer lock keys and returns a Prisma-serializable value", () => {
    expect(STUDENT_MONEY_LOCK_SQL).toBe(
      "SELECT pg_advisory_xact_lock($1::integer, $2::integer)::text AS locked",
    );
  });

  it("runs calls for the same student one after another", async () => {
    const events: string[] = [];
    const gate = deferred();
    const first = withStudentMoneyLock(institutionId, "student-seq", async () => {
      events.push("first:start");
      await gate.promise;
      events.push("first:end");
      return "first";
    });
    const second = withStudentMoneyLock(institutionId, "student-seq", async () => {
      events.push("second:start");
      return "second";
    });

    await settle();
    expect(events).toEqual(["first:start"]);

    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("runs calls for different students concurrently", async () => {
    const gate = deferred();
    let otherFinished = false;
    const blocked = withStudentMoneyLock(institutionId, "student-a", async () => {
      await gate.promise;
      return otherFinished;
    });

    await expect(
      withStudentMoneyLock(institutionId, "student-b", async () => {
        otherFinished = true;
        return "b";
      }),
    ).resolves.toBe("b");

    gate.resolve();
    await expect(blocked).resolves.toBe(true);
  });

  it("does not let a failed call block the next one for the same student", async () => {
    const gate = deferred();
    const failing = withStudentMoneyLock(institutionId, "student-err", async () => {
      await gate.promise;
      throw new Error("Refund Amount cannot exceed $0.00");
    });
    const next = withStudentMoneyLock(institutionId, "student-err", async () => "ok");

    gate.resolve();
    await expect(failing).rejects.toThrow("Refund Amount cannot exceed");
    await expect(next).resolves.toBe("ok");
    await expect(withStudentMoneyLock(institutionId, "student-err", async () => "after")).resolves.toBe("after");
  });

  it("scopes the lock by institution", async () => {
    const gate = deferred();
    const blocked = withStudentMoneyLock(institutionId, "student-shared", () => gate.promise.then(() => "a"));

    await expect(
      withStudentMoneyLock("00000000-0000-4000-8000-000000000099", "student-shared", async () => "other"),
    ).resolves.toBe("other");

    gate.resolve();
    await expect(blocked).resolves.toBe("a");
  });
});
