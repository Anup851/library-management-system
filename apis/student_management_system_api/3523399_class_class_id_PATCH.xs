// Edit class record
query "class/{class_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int class_id? filters=min:1
    dblink {
      table = "class"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch class {
      field_name = "id"
      field_value = $input.class_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $class
  }

  response = $class
}