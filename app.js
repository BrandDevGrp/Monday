const fallbackBoards = [
  {
    id: "demo",
    name: "Product launch",
    columns: [
      { id: "owner", title: "Owner", type: "people" },
      { id: "status", title: "Status", type: "status" },
      { id: "due", title: "Due", type: "date" },
      { id: "priority", title: "Priority", type: "status" }
    ],
    groups: [
      { id: "strategy", title: "Strategy", color: "#2563eb" },
      { id: "creative", title: "Creative production", color: "#16a34a" }
    ],
    items: [
      {
        id: "demo-1",
        name: "Confirm launch goals",
        group: { id: "strategy", title: "Strategy" },
        valuesByColumnId: { owner: "Maya", status: "Done", due: "Aug 2", priority: "High" }
      },
      {
        id: "demo-2",
        name: "Finalize channel plan",
        group: { id: "strategy", title: "Strategy" },
        valuesByColumnId: { owner: "Eli", status: "Working on it", due: "Aug 5", priority: "Medium" }
      },
      {
        id: "demo-3",
        name: "Write email sequence",
        group: { id: "creative", title: "Creative production" },
        valuesByColumnId: { owner: "Ari", status: "Working on it", due: "Aug 9", priority: "Medium" }
      }
    ]
  }
];

const state = {
  workspace: { id: "demo", name: "Workroom" },
  boards: fallbackBoards,
  activeBoardId: fallbackBoards[0].id,
  query: "",
  liveImported: false
};

const workspaceName = document.querySelector("#workspaceName");
const workspaceEyebrow = document.querySelector("#workspaceEyebrow");
const boardTitle = document.querySelector("#boardTitle");
const boardSummary = document.querySelector("#boardSummary");
const boardList = document.querySelector("#boardList");
const taskGroups = document.querySelector("#taskGroups");
const tableHead = document.querySelector("#tableHead");
const searchInput = document.querySelector("#searchInput");
const addTopTask = document.querySelector("#addTopTask");
const connectionStatus = document.querySelector("#connectionStatus");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1500);
}

function getActiveBoard() {
  return state.boards.find((board) => board.id === state.activeBoardId) || state.boards[0];
}

function getGridTemplate(board) {
  const fieldColumns = board.columns.map(() => "minmax(150px, 1fr)").join(" ");
  return `minmax(260px, 1.4fr) ${fieldColumns || "minmax(150px, 1fr)"}`;
}

function normalizeImportedBoard(board) {
  return {
    ...board,
    columns: board.columns || [],
    groups: board.groups || [],
    items: (board.items || []).map((item) => {
      const valuesByColumnId = {};
      (item.column_values || []).forEach((value) => {
        valuesByColumnId[value.id] = value.text || "";
      });

      return {
        ...item,
        valuesByColumnId
      };
    })
  };
}

function valueClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (["done", "complete", "completed", "approved", "yes"].includes(normalized)) {
    return "status-done";
  }
  if (["stuck", "blocked", "needs help", "overdue"].includes(normalized)) {
    return "status-stuck";
  }
  if (normalized.includes("working") || normalized.includes("progress")) {
    return "status-working";
  }
  return "";
}

function renderBoardList() {
  boardList.innerHTML = "";
  state.boards.forEach((board) => {
    const button = document.createElement("button");
    button.className = board.id === state.activeBoardId ? "selected" : "";
    button.type = "button";
    button.textContent = board.name;
    button.addEventListener("click", () => {
      state.activeBoardId = board.id;
      render();
    });
    boardList.appendChild(button);
  });
}

function renderTableHead(board) {
  tableHead.style.gridTemplateColumns = getGridTemplate(board);
  tableHead.innerHTML = "<span>Item</span>";
  board.columns.forEach((column) => {
    const header = document.createElement("span");
    header.textContent = column.title;
    header.title = `${column.title} (${column.type})`;
    tableHead.appendChild(header);
  });
}

function renderRows(board) {
  const query = state.query.toLowerCase();
  taskGroups.innerHTML = "";

  const visibleItems = board.items.filter((item) => {
    const searchable = [item.name, item.group?.title, ...Object.values(item.valuesByColumnId || {})]
      .join(" ")
      .toLowerCase();
    return searchable.includes(query);
  });

  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = query ? "No matching LiveNet items" : "No items on this board";
    taskGroups.appendChild(empty);
    return;
  }

  const groups = board.groups.length
    ? board.groups
    : [{ id: "ungrouped", title: "Items", color: "#2563eb" }];

  groups.forEach((group) => {
    const groupItems = visibleItems.filter((item) => (item.group?.id || "ungrouped") === group.id);
    if (!groupItems.length) {
      return;
    }

    const title = document.createElement("div");
    title.className = "group-title";
    title.innerHTML = `<span class="group-dot" style="background:${group.color || "#2563eb"}"></span><span>${group.title}</span>`;
    taskGroups.appendChild(title);

    groupItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "task-row";
      row.style.gridTemplateColumns = getGridTemplate(board);

      const itemName = document.createElement("span");
      itemName.className = "item-name";
      itemName.textContent = item.name;
      row.appendChild(itemName);

      board.columns.forEach((column) => {
        const cell = document.createElement("span");
        const value = item.valuesByColumnId?.[column.id] || "";
        const statusClass = column.type === "status" ? valueClass(value) : "";

        if (statusClass && value) {
          const pill = document.createElement("span");
          pill.className = `pill ${statusClass}`;
          pill.textContent = value;
          cell.appendChild(pill);
        } else {
          cell.textContent = value || "-";
        }

        row.appendChild(cell);
      });

      taskGroups.appendChild(row);
    });
  });
}

function render() {
  const board = getActiveBoard();
  workspaceName.textContent = state.workspace.name;
  workspaceEyebrow.textContent = state.liveImported ? "monday workspace" : "Workspace";
  boardTitle.textContent = board.name;
  boardSummary.textContent = state.liveImported
    ? `${board.items.length} items, ${board.columns.length} fields copied from monday.com`
    : "Plan, assign, and track every launch task in one shared workspace.";

  renderBoardList();
  renderTableHead(board);
  renderRows(board);
}

async function importLiveNetWorkspace() {
  try {
    const response = await fetch("/api/monday/workspaces/livenet");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Import failed");
    }

    state.workspace = payload.workspace;
    state.boards = payload.boards.map(normalizeImportedBoard);
    state.activeBoardId = state.boards[0]?.id || fallbackBoards[0].id;
    state.liveImported = true;
    connectionStatus.textContent = `LiveNet imported: ${state.boards.length} boards`;
    connectionStatus.classList.add("connected");
    render();
  } catch (error) {
    connectionStatus.textContent = "LiveNet import failed";
    connectionStatus.classList.add("error");
    showToast("LiveNet import failed");
  }
}

function addTask() {
  showToast(state.liveImported ? "Live monday boards are read-only here" : "Task added");
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

addTopTask.addEventListener("click", addTask);
render();
importLiveNetWorkspace();
