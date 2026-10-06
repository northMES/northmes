export const stages = Object.freeze([]);

export async function run(stages, options, io) {
  io.log(`stages: ${stages.map((stage) => stage.name).join(', ')}`);
  for (const stage of stages) {
    await stage.generate(io.root);
  }
  return 0;
}
