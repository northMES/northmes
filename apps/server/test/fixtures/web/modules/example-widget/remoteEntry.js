// The entry of a fixture remote whose module the catalog never loads.
export const get = () => Promise.resolve({ default: { id: 'example-widget' } });
