// Edit student record
query "student/{student_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int student_id? filters=min:1
    dblink {
      table = "student"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch student {
      field_name = "id"
      field_value = $input.student_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $student
  }

  response = $student
}