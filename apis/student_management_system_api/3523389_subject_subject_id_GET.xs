// Get subject record
query "subject/{subject_id}" verb=GET {
  api_group = "Student Management System API"

  input {
    int subject_id? filters=min:1
  }

  stack {
    db.get subject {
      field_name = "id"
      field_value = $input.subject_id
    } as $subject
  
    precondition ($subject != null) {
      error_type = "notfound"
      error = "Not Found."
    }
  }

  response = $subject
}