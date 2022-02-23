import fetch from "node-fetch";


export interface Manifest {
  [version: string]: {
    dependencies?: { [dep: string]: string };
    dist: { shasum: string; tarball: string };
  };
}

const REGISTRY = process.env.REGISTRY || "https://registry.npmjs.org/";


const cache: { [dep: string]: Manifest } = Object.create(null);

export default async function (name: string): Promise<Manifest> {
  
  if (cache[name]) {
    return cache[name];
  }

  const response = await fetch(`${REGISTRY}${name}`);

  const json = await response.json();
    //@ts-ignore
  if (json.error) {
    throw new ReferenceError(`No such package: ${name}`);
  }


    //@ts-ignore
  return (cache[name] = json.versions);
}
