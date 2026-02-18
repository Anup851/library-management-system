// Get mark record
query "mark/{mark_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int mark_id? filters=min:1
  }

  stack {
    db.get mark {
      field_name = "id"
      field_value = $input.mark_id
    } as $mark
  
    precondition ($mark != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $mark
}