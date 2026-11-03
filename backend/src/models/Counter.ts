import mongoose, { Schema, type ClientSession } from "mongoose";

export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter =
  (mongoose.models.Counter as mongoose.Model<CounterDoc>) ??
  mongoose.model<CounterDoc>("Counter", counterSchema);

export async function getNextSequence(name: string, session?: ClientSession): Promise<number> {
  const query = Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  if (session) {
    query.session(session);
  }
  const counter = await query.lean();
  if (!counter) {
    throw new Error(`Failed to allocate sequence '${name}'`);
  }
  return counter.seq;
}

export async function setSequenceFloor(name: string, value: number): Promise<void> {
  await Counter.updateOne({ _id: name }, { $max: { seq: value } }, { upsert: true });
}
