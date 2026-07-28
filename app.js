const statuses = [
  { label: "Working on it", className: "status-working" },
  { label: "Done", className: "status-done" },
  { label: "Stuck", className: "status-stuck" }
];

const groups = [
  {
    name: "Strategy",
    color: "#2563eb",
    tasks: [
      { name: "Confirm launch goals", owner: "Maya", status: 1, due: "Aug 2", priority: "High" },
      { name: "Finalize channel plan", owner: "Eli", status: 0, due: "Aug 5", priority: "Medium" },
      { name: "Approve pricing notes", owner: "Noah", status: 2, due: "Aug 7", priority: "High" }
    ]
  },
  {
    name: "Creative production",
    color: "#16a34a",
    tasks: [
      { name: "Write email sequence", owner: "Ari", status: 0, due: "Aug 9", priority: "Medium" },
      { name: "Export product demo cuts", owner: "Jules", status: 1, due: "Aug 10", priority: "Low" },
      { name: "QA landing page copy", owner: "Maya", status: 0, due: "Aug 12", priority: "High" }
    ]
  }
];

const taskGroups = document.querySelector("#taskGroups");
const searchInput = document.querySelector("#searchInput");
const addTopTask = document.querySelector("#addTopTask");
const toast = document.querySelector("#toast");

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1500);
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  taskGroups.innerHTML = "";

  groups.forEach((group, groupIndex) => {
    const visibleTasks = group.tasks.filter((task) => {
      return [task.name, task.owner, task.priority, statuses[task.status].label]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    if (!visibleTasks.length) {
      return;
    }

    const title = document.createElement("div");
    title.className = "group-title";
    title.innerHTML = `<span class="group-dot" style="background:${group.color}"></span><span>${group.name}</span>`;
    taskGroups.appendChild(title);

    visibleTasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "task-row";

      const currentStatus = statuses[task.status];
      row.innerHTML = `
        <label>
          <input class="task-name" value="${task.name}" aria-label="Task name" />
        </label>
        <span class="owner"><span class="avatar">${initials(task.owner)}</span>${task.owner}</span>
        <span><button class="pill ${currentStatus.className}" type="button">${currentStatus.label}</button></span>
        <span>${task.due}</span>
        <span class="priority ${task.priority.toLowerCase()}">${task.priority}</span>
      `;

      const nameInput = row.querySelector(".task-name");
      nameInput.addEventListener("input", (event) => {
        task.name = event.target.value;
      });

      const statusButton = row.querySelector(".pill");
      statusButton.addEventListener("click", () => {
        task.status = (task.status + 1) % statuses.length;
        render();
      });

      taskGroups.appendChild(row);
    });

    const addRow = document.createElement("button");
    addRow.className = "group-title";
    addRow.type = "button";
    addRow.textContent = "+ Add task";
    addRow.addEventListener("click", () => addTask(groupIndex));
    taskGroups.appendChild(addRow);
  });
}

function addTask(groupIndex = 0) {
  groups[groupIndex].tasks.push({
    name: "New launch task",
    owner: "Maya",
    status: 0,
    due: "Aug 15",
    priority: "Medium"
  });
  searchInput.value = "";
  render();
  showToast("Task added");
}

searchInput.addEventListener("input", render);
addTopTask.addEventListener("click", () => addTask(0));
render();
