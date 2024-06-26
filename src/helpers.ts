import * as vscode from "vscode";
import { posix } from "path";
import cuid = require("cuid");
import type { Time } from "./types";
import { shortEnglishHumanizer } from "./humanize";

// Get the current project name
export function getCurrentProject() {
  let currentProject: string | undefined = undefined;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    currentProject = workspaceFolders[0].name;
  }
  return currentProject;
}

// Get the current branch name
export function getCurrentBranch() {
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  if (!gitExtension) {
    return undefined;
  }

  const api = gitExtension.getAPI(1);
  const repo = api.repositories[0];
  if (!repo) {
    return undefined;
  }

  return repo.state.HEAD?.name;
}

export function fetchAllRowsAfter(db: any, date?: number) {
  if (date) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM Time WHERE start > ?",
        [date],
        (err: any, rows: Time[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    }) as Promise<Time[]>;
  } else {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM Time;", [date], (err: any, rows: Time[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    }) as Promise<Time[]>;
  }
}

export function fetchAllRowsBetween(db: any, start: Date, end: Date) {
  // convert start and end to numbers
  const startNum = start.getTime();
  const endNum = end.getTime();

  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM Time WHERE start BETWEEN ? AND ? ;",
      [startNum, endNum],
      (err: any, rows: Time[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  }) as Promise<Time[]>;
}

export async function getTodaysTime(db: any) {
  //  startOfToday as a number
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayNumber = startOfToday.getTime();

  let todaysTime = await fetchAllRowsAfter(db, startOfTodayNumber)
    .then((data) => {
      let total = 0;
      data.forEach((row: Time) => {
        if (row.end) {
          total += row.end - row.start;
        }
      });
      return total;
    })
    .catch((err) => {
      console.log(err);
      return 0;
    });

  return prettyTime(todaysTime);
}

export function prettyTime(ms: number) {
  return shortEnglishHumanizer(ms, {
    delimiter: " ",
    spacer: "",
    maxDecimalPoints: 0,
    round: true,
    units: ["h", "m"],
  });
}

export function startTimeTracking(
  db: any,
  currentProject: string,
  branch: string
) {
  db.run("INSERT INTO Time (id, project, branch, start) VALUES (?, ?, ?, ?)", [
    cuid(),
    currentProject,
    branch,
    Date.now(),
  ]);
}

export function stopTimeTracking(db: any) {
  db.run("UPDATE Time SET end = ? WHERE end IS NULL", [Date.now()]);
}

export async function exportJSONData(data: any) {
  const writeStr = JSON.stringify(data, null, 2);
  const writeData = Buffer.from(writeStr, "utf8");
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const folderUri = vscode.workspace.workspaceFolders[0].uri;
    const fileUri = folderUri.with({
      path: posix.join(folderUri.path, "project-time.json"),
    });
    await vscode.workspace.fs.writeFile(fileUri, writeData);
    // Display a message box to the user
    vscode.window.showInformationMessage("Project Time: Export complete!");
  } else {
    vscode.window.showErrorMessage("Project Time: No workspace folder found.");
  }
}
