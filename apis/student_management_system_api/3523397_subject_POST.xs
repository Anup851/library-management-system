// Add subject record
query subject verb=POST {
  api_group = "Student Management System API"

  input {
    dblink {
      table = "subject"
    }
  }

  stack {
    db.add subject {
      data = {created_at: "now"}
    } as $subject
  }

  response = $subject
}