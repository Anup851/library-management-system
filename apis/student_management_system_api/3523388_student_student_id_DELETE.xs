// Delete student record.
query "student/{student_id}" verb=DELETE {
  api_group = "Student Management System API"

  input {
    int student_id? filters=min:1
  }

  stack {
    db.del student {
      field_name = "id"
      field_value = $input.student_id
    }
  }

  response = null
}