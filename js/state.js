// Shared AutoCite state.
// Keeping state in one place makes it easier for small files to work together.

window.AutoCiteState = {
  currentHistory: [],
  projects: [],
  selectedProjectId: "all",
  exportProjectId: "all",
  selectedHistoryIndexes: new Set(),
  editingHistoryIndexes: new Set()
};
