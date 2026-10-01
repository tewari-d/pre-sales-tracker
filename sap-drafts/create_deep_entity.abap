  METHOD /iwbep/if_mgw_appl_srv_runtime~create_deep_entity.
    " Step 1: Define Deep Structure
    TYPES: BEGIN OF ty_deep.
             INCLUDE TYPE /ngr/cl_od_ps_tracker_mpc_ext=>ts_xngrxcds_ps_mastertype.
    TYPES:   toparters TYPE STANDARD TABLE OF /ngr/cl_od_ps_tracker_mpc_ext=>ts_xngrxcds_ps_partnertype WITH DEFAULT KEY,
             toremarks TYPE STANDARD TABLE OF /ngr/cl_od_ps_tracker_mpc_ext=>ts_xngrxcds_ps_remarkstype WITH DEFAULT KEY,
           END OF ty_deep.

    DATA(lv_ps_entry) = VALUE ty_deep( ).

    " Step 2: Read incoming data
    io_data_provider->read_entry_data(
      IMPORTING
        es_data = lv_ps_entry
    ).

    IF lv_ps_entry-status = 'SUBMITTED' OR lv_ps_entry-status = 'WIN' OR lv_ps_entry-status = 'COMPLETE'.
      IF lv_ps_entry-opptcv <= 0 OR lv_ps_entry-currency IS INITIAL
         OR ( ( lv_ps_entry-currency = 'USD' OR lv_ps_entry-currency = 'EUR' )
              AND lv_ps_entry-opptcv <= 1 ).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING message = 'Opp. Size and currency are required; USD/EUR size must exceed 1'.
      ENDIF.
    ENDIF.
    IF ( lv_ps_entry-status = 'WIN' OR lv_ps_entry-status = 'COMPLETE' )
       AND lv_ps_entry-closedate IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING message = 'Win/Loss Date is required for won opportunities'.
    ENDIF.

    SELECT SINGLE @abap_true FROM /ngr/t_master INTO @DATA(lv_already_exists) WHERE id = @lv_ps_entry-id.
    IF lv_already_exists = abap_true.
      "Update on this entry via deep entity is not needed
      mo_context->get_message_container( )->add_message_text_only( iv_msg_type = 'E'
                                                                   iv_msg_text = 'Not Supported' ).
      RETURN.
    ENDIF.

    "get unique id
    DATA(lv_id) = VALUE /ngr/t_master-id( ).
    CALL FUNCTION 'NUMBER_GET_NEXT'
      EXPORTING
        nr_range_nr             = '1'
        object                  = '/NGR/NR_PS'
      IMPORTING
        number                  = lv_id
      EXCEPTIONS
        interval_not_found      = 1
        number_range_not_intern = 2
        object_not_found        = 3
        quantity_is_0           = 4
        quantity_is_not_1       = 5
        interval_overflow       = 6
        buffer_overflow         = 7
        OTHERS                  = 8.
    IF sy-subrc <> 0.
      mo_context->get_message_container( )->add_message_text_only( iv_msg_type = 'E'
                                                                   iv_msg_text = 'Cannot generate Opportunity ID' ).
      RETURN.
    ENDIF.
    "Populate header fields
    " Note: the free-text PROPOSAL_TYPE column stays in /NGR/T_MASTER for legacy data
    " but is no longer exposed by /NGR/CDS_PS_MASTER, so it is not mapped here.
    DATA(lv_ps_header) = CORRESPONDING /ngr/t_master( lv_ps_entry MAPPING
       customer_name       = customername
       customer_desc       = customerdesc
       opp_desc            = oppdesc
       geography           = geography
       line_of_business    = lineofbusiness
       solution_area       = solutionarea
       country             = country
       deal_type           = dealtype
       opp_type            = opptype
       received_date       = receiveddate
       submission_date     = submissiondate
       status              = status
       opp_tcv             = opptcv
       currency            = currency
       comm_model          = commmodel
       close_date          = closedate
       sap_system_category = sapsystemcategory
       opp_category        = opportunitytype
       probability         = probability
       doc_url             = docurl
       commercial_url      = commercialurl
       planned_subm_date   = plannedsubmissiondate
       due_submission_date = duesubmissiondate
       reviewed_by_ps      = presalesreviewwer
       reviewed_by_pr      = practicereviewwer
       resource_fut_dmd    = resourcefuturedemandupdated
       next_followup_date  = nextfollowupdate
       opp_type_ot         = opptypeother
       line_of_business_ot = lineofbusinessother
       bu_details          = budetails
       complexity          = complexity
       win_chance          = winchance
       proposal_type_op    = proposaltypeop
 ).

    IF lv_ps_entry-opptype NE 'OTR'.
      CLEAR lv_ps_header-opp_type_ot.
    ENDIF.
    IF lv_ps_entry-lineofbusiness NE 'OTHR' .
      CLEAR lv_ps_header-line_of_business_ot.
    ENDIF.

    IF lv_ps_entry-status EQ 'WIP'.
      CLEAR lv_ps_header-submission_date.
    ENDIF.
    IF NOT ( lv_ps_entry-status EQ 'WIN' OR lv_ps_entry-status EQ 'COMPLETE' OR lv_ps_entry-status EQ 'LOSS' ).
      CLEAR lv_ps_header-close_date.
    ENDIF.

    lv_ps_entry-id = lv_ps_header-id = lv_id.
    lv_ps_header-created_by = sy-uname.
    lv_ps_header-created_on = sy-datum.
    lv_ps_header-created_at = sy-uzeit.

    "Populate Remarks
    IF lv_ps_entry-toremarks IS NOT INITIAL.
      DATA(lv_ps_remarks) = VALUE /ngr/t_remarks(
          id         = lv_id
          rm_item    = 1
          rm_text    = VALUE #( lv_ps_entry-toremarks[ 1 ]-rmtext OPTIONAL )
          created_by = sy-uname
          created_on = sy-datum
          created_at = sy-uzeit ).
    ENDIF.

    "populate partners
    DATA: lt_ps_partners TYPE STANDARD TABLE OF /ngr/t_partner.
    IF lv_ps_entry-toparters IS NOT INITIAL.
      lt_ps_partners = VALUE #( FOR lv_partner IN lv_ps_entry-toparters
                                INDEX INTO lv_index
                                ( VALUE /ngr/t_partner( id               = lv_id
                                                        partner_function = lv_partner-partnerfunction
                                                        partner_item     = lv_index
                                                        partner_name     = lv_partner-partnername
                                                        partner_email    = lv_partner-partneremail
                                                        created_by       = sy-uname
                                                        created_on       = sy-datum
                                                        created_at       = sy-uzeit ) ) ).
    ENDIF.

    INSERT /ngr/t_master FROM lv_ps_header.
    IF sy-subrc <> 0.
      DATA(lv_insert_error) = abap_true.
    ELSE.
      IF lv_ps_remarks IS NOT INITIAL.
        INSERT /ngr/t_remarks FROM lv_ps_remarks.
        IF sy-subrc <> 0 .
          lv_insert_error = abap_true.
        ENDIF.
      ENDIF.
      IF lt_ps_partners IS NOT INITIAL.
        INSERT /ngr/t_partner FROM TABLE lt_ps_partners.
        IF sy-subrc <> 0.
          lv_insert_error = abap_true.
        ENDIF.
      ENDIF.
    ENDIF.

    IF lv_insert_error <> abap_true.
      COMMIT WORK AND WAIT.

      copy_data_to_ref(
        EXPORTING
          is_data = lv_ps_entry
        CHANGING
          cr_data = er_deep_entity
      ).
    ELSE.
      ROLLBACK WORK.
      mo_context->get_message_container( )->add_message_text_only( iv_msg_type = 'E'
                                                                         iv_msg_text = 'Cannot create Opportunity' ).
    ENDIF.

  ENDMETHOD.
