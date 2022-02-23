import * as fs from "fs-extra";
import findUp from "find-up";
import yargs from "yargs";
import * as utils from "./utils";
import list, { PackageJson } from "./list";
import install from "./install";
import * as log from "./log";
import * as lock from "./lock";


export default async function (args: yargs.Arguments) {

  //@ts-ignore
  const jsonPath = (await findUp("package.json"))!;
  const root = await fs.readJson(jsonPath);


  const additionalPackages = args._.slice(1);
  if (additionalPackages.length) {
    if (args["save-dev"] || args.dev) {
      root.devDependencies = root.devDependencies || {};
   
      additionalPackages.forEach((pkg) => (root.devDependencies[pkg] = ""));
    } else {
      root.dependencies = root.dependencies || {};
  
      additionalPackages.forEach((pkg) => (root.dependencies[pkg] = ""));
    }
  }

 
  if (args.production) {
    delete root.devDependencies;
  }

  await lock.readLock();

  const info = await list(root);

  lock.writeLock();


  log.prepareInstall(
    Object.keys(info.topLevel).length + info.unsatisfied.length
  );


  await Promise.all(
    Object.entries(info.topLevel).map(([name, { url }]) => install(name, url))
  );

  await Promise.all(
    info.unsatisfied.map((item) =>
      install(item.name, item.url, `/node_modules/${item.parent}`)
    )
  );

  beautifyPackageJson(root);


  fs.writeJson(jsonPath, root, { spaces: 2 });


}


function beautifyPackageJson(packageJson: PackageJson) {
  if (packageJson.dependencies) {
    packageJson.dependencies = utils.sortKeys(packageJson.dependencies);
  }

  if (packageJson.devDependencies) {
    packageJson.devDependencies = utils.sortKeys(packageJson.devDependencies);
  }
}
