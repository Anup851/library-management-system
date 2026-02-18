// Get student record
query "student/{student_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int student_id? filters=min:1
  }

  stack {
    db.get student {
      field_name = "id"
      field_value = $input.student_id
    } as $student
  
    precondition ($student != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $student
}