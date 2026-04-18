export interface SignInData {
  username: string
  password: string
}

export interface SignUpData {
  username: string
  email: string
  password: string
  role: string
  department_id: string | null
}
