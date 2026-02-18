// Add student record
query student verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "student"
    }
  }

  stack {
    db.add student {
      data = {created_at: "now"}
    } as $student
  }

  response = $student
}