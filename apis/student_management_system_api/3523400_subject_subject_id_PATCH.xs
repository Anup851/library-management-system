// Edit subject record
query "subject/{subject_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int subject_id? filters=min:1
    dblink {
      table = "subject"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch subject {
      field_name = "id"
      field_value = $input.subject_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $subject
  }

  response = $subject
}