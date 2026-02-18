// Get class record
query "class/{class_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int class_id? filters=min:1
  }

  stack {
    db.get class {
      field_name = "id"
      field_value = $input.class_id
    } as $class
  
    precondition ($class != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $class
}