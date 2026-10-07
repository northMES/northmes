import "reflect-metadata";
const { TypeMetadataStorage } = await import("@nestjs/graphql");
const planning = (await import("@northmes/module-planning/manifest")).default;
const mod = (await planning.server()).default;
TypeMetadataStorage.compile?.();
for (const o of TypeMetadataStorage.getObjectTypesMetadata()) console.log("obj", o.name, o.registerIn?.()?.name);
for (const m of TypeMetadataStorage.getMutationsMetadata?.() ?? []) console.log("mut", m.name, m.typeFn()?.name, m.target?.name);
