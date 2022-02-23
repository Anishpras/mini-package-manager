import * as semver from "semver";
import resolve from "./resolve";
import * as log from "./log";
import * as lock from "./lock";

interface DependenciesMap {
  [dependency: string]: string;
}
// eslint-disable-next-line @typescript-eslint/no-type-alias
type DependencyStack = Array<{
  name: string;
  version: string;
  dependencies: { [dep: string]: string };
}>;
export interface PackageJson {
  dependencies?: DependenciesMap;
  devDependencies?: DependenciesMap;
}


const topLevel: {
  [name: string]: { url: string; version: string };
} = Object.create(null);

const unsatisfied: Array<{ name: string; parent: string; url: string }> = [];

async function collectDeps(
  name: string,
  constraint: string,
  stack: DependencyStack = []
) {

  const fromLock = lock.getItem(name, constraint);


  const manifest = fromLock || (await resolve(name));


  log.logResolving(name);


  const versions = Object.keys(manifest);
  const matched = constraint
    ? semver.maxSatisfying(versions, constraint)
    : versions[versions.length - 1];
  if (!matched) {
    throw new Error("Cannot resolve suitable package.");
  }

  if (!topLevel[name]) {
    
    topLevel[name] = { url: manifest[matched].dist.tarball, version: matched };
  } else if (semver.satisfies(topLevel[name].version, constraint)) {
    const conflictIndex = checkStackDependencies(name, matched, stack);
    if (conflictIndex === -1) {
    
      return;
    }
  
    unsatisfied.push({
      name,
      parent: stack
        .map(({ name }) => name) // eslint-disable-line no-shadow
        .slice(conflictIndex - 2)
        .join("/node_modules/"),
      url: manifest[matched].dist.tarball,
    });
  } else {
   
    unsatisfied.push({
      name,
      parent: stack[stack.length - 1].name,
      url: manifest[matched].dist.tarball,
    });
  }

  
  const dependencies = manifest[matched].dependencies || null;

 
  lock.updateOrCreate(`${name}@${constraint}`, {
    version: matched,
    url: manifest[matched].dist.tarball,
    shasum: manifest[matched].dist.shasum,
    dependencies,
  });

  
  if (dependencies) {
    stack.push({
      name,
      version: matched,
      dependencies,
    });
    await Promise.all(
      Object.entries(dependencies)
    
        .filter(([dep, range]) => !hasCirculation(dep, range, stack))
        .map(([dep, range]) => collectDeps(dep, range, stack.slice()))
    );
    stack.pop();
  }


  if (!constraint) {
    return { name, version: `^${matched}` };
  }
}


function checkStackDependencies(
  name: string,
  version: string,
  stack: DependencyStack
) {
  return stack.findIndex(({ dependencies }) => {
 
    if (!dependencies[name]) {
      return true;
    }


    return semver.satisfies(version, dependencies[name]);
  });
}


function hasCirculation(name: string, range: string, stack: DependencyStack) {
  return stack.some(
    (item) => item.name === name && semver.satisfies(item.version, range)
  );
}


export default async function (rootManifest: PackageJson) {



  if (rootManifest.dependencies) {
    (
      await Promise.all(
        Object.entries(rootManifest.dependencies).map((pair) =>
          collectDeps(...pair)
        )
      )
    )
      .filter(Boolean)
      .forEach(
        (item) => (rootManifest.dependencies![item!.name] = item!.version)
      );
  }

 
  if (rootManifest.devDependencies) {
    (
      await Promise.all(
        Object.entries(rootManifest.devDependencies).map((pair) =>
          collectDeps(...pair)
        )
      )
    )
      .filter(Boolean)
      .forEach(
        (item) => (rootManifest.devDependencies![item!.name] = item!.version)
      );
  }

  return { topLevel, unsatisfied };
}
