// Get exam record
query "exam/{exam_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int exam_id? filters=min:1
  }

  stack {
    db.get exam {
      field_name = "id"
      field_value = $input.exam_id
    } as $exam
  
    precondition ($exam != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $exam
}