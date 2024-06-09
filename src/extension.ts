import * as vscode from "vscode";
import { init } from "./init";
import {
  getCurrentBranch,
  getCurrentProject,
  getTodaysTime,
  startTimeTracking,
  stopTimeTracking,
} from "./helpers";
import { exportAllTimes, exportTimesBetween } from "./exports";

let db: any;
let myStatusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated.
export function activate(context: vscode.ExtensionContext) {
  console.log("Activating Project Time");
  // Initialize the required folders and sqlite database
  db = init(context);

  // Get the current project name
  const currentProject = getCurrentProject();

  let currentBranch = getCurrentBranch();

  // only track time if in a project folder
  if (currentProject !== undefined && currentBranch !== undefined) {
    // Start time tracking
    startTimeTracking(db, currentProject, currentBranch);

    // Check for changes in editor focus
    vscode.window.onDidChangeWindowState((e) => {
      // if within a project folder
      if (e.focused === true) {
        console.log("started in window change - " + currentBranch);
        startTimeTracking(db, currentProject, currentBranch);
      } else {
        console.log("stopped in window change - " + currentBranch);
        stopTimeTracking(db);
      }
    });

    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
    if (!gitExtension) {
      return;
    }

    const api = gitExtension.getAPI(1);
    const handleBranchChange = (repo: any) => {
      if (repo.state.HEAD?.name !== currentBranch) {
        currentBranch = repo.state.HEAD?.name;
        stopTimeTracking(db);
        startTimeTracking(db, currentProject, currentBranch);
      }
    };

    console.log("adding listener - " + currentBranch);
    api.onDidOpenRepository((repo: any) => {
      console.log("changed in open repository - " + repo.state.HEAD?.name);
      handleBranchChange(repo);
      repo.state.onDidChange(() => handleBranchChange(repo));
    });

    // Handle already open repositories
    api.repositories.forEach((repo: any) => {
      handleBranchChange(repo);
      console.log(
        "changed in open repository foreach - " + repo.state.HEAD?.name
      );
      repo.state.onDidChange(() => handleBranchChange(repo));
    });
  }

  // register a command that is invoked when the status bar
  // item is selected
  const myCommandId = "project-time.todays-time";
  context.subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      vscode.window.showInformationMessage(`Project Time is active!`);
    })
  );

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    200
  );
  myStatusBarItem.command = myCommandId;
  context.subscriptions.push(myStatusBarItem);

  // register some listener that make sure the status bar
  // item always up-to-date
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(updateStatusBarItem)
  );

  // command to export all times
  const exportAll = vscode.commands.registerCommand(
    "project-time.export-json",
    () => {
      exportAllTimes(db);
    }
  );
  context.subscriptions.push(exportAll);

  // command to export all times between two dates
  const exportBetween = vscode.commands.registerCommand(
    "project-time.export-between-json",
    () => {
      exportTimesBetween(db);
    }
  );
  context.subscriptions.push(exportBetween);

  // update status bar item once at start
  updateStatusBarItem();
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Project Time: Deactivating");
  stopTimeTracking(db);
  db.close();
}

// update status bar item
function updateStatusBarItem() {
  console.log("Project Time: Updating status bar!");
  getTodaysTime(db).then((todaysTime) => {
    console.log("Todays Time is", todaysTime);
    myStatusBarItem.text = `$(clock) ${todaysTime}`;
    myStatusBarItem.tooltip = `Your time spent in VS Code today is ${todaysTime}`;
    myStatusBarItem.show();
  });
}
