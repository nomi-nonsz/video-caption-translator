interface State {
  tmpFiles: Set<string>
}

export const state: State = {
  tmpFiles: new Set()
}