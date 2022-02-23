import fetch from "node-fetch";
import * as tar from "tar";
import * as fs from "fs-extra";
import * as log from "./log";

export default async function (name: string, url: string, location = "") {

  const path = `${process.cwd()}${location}/node_modules/${name}`;

  await fs.mkdirp(path);

  const response = await fetch(url);

    //@ts-ignore
  response.body
    .pipe(tar.extract({ cwd: path, strip: 1 }))
    .on("close", log.tickInstalling); 
}
