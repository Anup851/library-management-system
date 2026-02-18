// Edit mark record
query "mark/{mark_id}" verb=PATCH {
  api_group = "Student Management System API"

  input {
    int mark_id? filters=min:1
    dblink {
      table = "mark"
    }
  }

  stack {
    util.get_raw_input {
      encoding = "json"
      exclude_middleware = false
    } as $raw_input
  
    db.patch mark {
      field_name = "id"
      field_value = $input.mark_id
      data = `$input|pick:($raw_input|keys)`|filter_null|filter_empty_text
    } as $mark
  }

  response = $mark
}