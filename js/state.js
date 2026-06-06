// Shared AutoCite state.
// Keeping state in one place makes it easier for small files to work together.

window.AutoCiteState = {
  currentHistory: [],
  selectedHistoryIndexes: new Set(),
  editingHistoryIndexes: new Set()
};
