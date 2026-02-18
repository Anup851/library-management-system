// Add exam record
query exam verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "exam"
    }
  }

  stack {
    db.add exam {
      data = {created_at: "now"}
    } as $exam
  }

  response = $exam
}